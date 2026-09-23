/**
 * optiwork-math-core.js
 * ----------------------------------------------------------------
 * OPTIWORK'ün arkasındaki tüm matematiksel/istatistiksel mantık.
 *
 * Bu dosya BİLEREK dashboard.html ve zaman-cizelgesi.html içindeki koddan
 * ayrıldı: o dosyalardaki aynı fonksiyonlar DOM'a ve global değişkenlere
 * (TASKS, EMPLOYEES, ATTEND...) doğrudan erişiyordu. Burada her fonksiyon
 * SAF (pure) hale getirildi: girdi olarak veri alır, çıktı olarak veri
 * döner. Ne ekrana yazar, ne localStorage okur, ne global değişkene
 * dokunur. Bu yüzden:
 *   - Node.js'te tek başına test edilebilir (console.log ile)
 *   - Formülleri değiştirip aynı veriyle sonucu karşılaştırmak kolaydır
 *   - Dashboard'un binlerce satırlık HTML/CSS'i arasında aramaya gerek
 *     kalmadan tüm "hesaplama" burada, tek yerde durur
 *
 * HTML dosyalarında kullanmak için:
 *   <script src="optiwork-math-core.js"></script>
 *   (fonksiyonlar global scope'a window.OptiworkMath altında eklenir)
 *
 * Node.js / test ortamında:
 *   const M = require('./optiwork-math-core.js');
 * ----------------------------------------------------------------
 */

(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = mod; // Node.js / CommonJS
  } else {
    root.OptiworkMath = mod; // Tarayıcı: window.OptiworkMath
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ================================================================
  // YARDIMCI İSTATİSTİK FONKSİYONLARI
  // ================================================================

  function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  // ================================================================
  // 1) GÜNLÜK ÇALIŞMA SÜRESİ HESABI (Yasal Ara Kuralı)
  // ================================================================
  /**
   * Mesai başlangıç/bitiş saatinden brüt, yasal ara ve net çalışma
   * süresini hesaplar.
   *
   * KURAL: Bitiş saati 12:00'den SONRA ise 90 dakika yasal ara düşülür
   * (60 dk yemek + 30 dk ek dinlenme). Bitiş 12:00 veya öncesindeyse
   * (örn. yarım gün mesaisi) ara düşülmez.
   *
   * @param {string} baslangic - "HH:MM" formatında mesai başlangıcı
   * @param {string} bitis     - "HH:MM" formatında mesai bitişi
   * @returns {{brut:number, yasalAra:number, net:number}} dakika cinsinden
   *
   * @example
   * sureHesapla("07:45", "16:30")
   * // -> { brut: 525, yasalAra: 90, net: 435 }
   */
  function sureHesapla(baslangic, bitis) {
    const [bh, bm] = baslangic.split(":").map(Number);
    const [eh, em] = bitis.split(":").map(Number);
    let bas = bh * 60 + bm;
    let bit = eh * 60 + em;
    if (bit < bas) bit += 24 * 60; // gece vardiyasını da destekler

    const brut = Math.max(0, bit - bas);
    const bitisSaatOndalik = eh + em / 60;
    const yasalAra = bitisSaatOndalik > 12 ? 90 : 0;
    const net = brut - yasalAra;

    return { brut, yasalAra, net };
  }

  // ================================================================
  // 2) SAPMA SINIFLANDIRMASI (Eşik Değerleri)
  // ================================================================
  /**
   * Bir kişinin beyanının, şeflik ortalamasından yüzde kaç saptığına göre
   * uyarı etiketi üretir. Eşikler ASİMETRİKTİR: bir işi çok hızlı bitirmek
   * (negatif sapma) ile çok yavaş bitirmek (pozitif sapma) farklı
   * toleransa sahiptir.
   *
   *   sapma > 200%  veya  sapma < -80%   -> "AŞIRI SAPMA! (Hatalı Giriş)"
   *   sapma >  75%  veya  sapma < -50%   -> "İncelenebilir"
   *   diğer her durum                    -> "Sorun Yok"
   *
   * @param {number} sapmaYuzdesi - ör. 42.5 (=%42.5 sapma)
   * @returns {"AŞIRI SAPMA! (Hatalı Giriş)"|"İncelenebilir"|"Sorun Yok"}
   */
  function classifySapma(sapmaYuzdesi) {
    if (sapmaYuzdesi > 200 || sapmaYuzdesi < -80) return "AŞIRI SAPMA! (Hatalı Giriş)";
    if (sapmaYuzdesi > 75 || sapmaYuzdesi < -50) return "İncelenebilir";
    return "Sorun Yok";
  }

  // ================================================================
  // 3) İKİ GEÇİŞLİ BENCHMARK MOTORU (Çekirdek Algoritma)
  // ================================================================
  /**
   * Bir dönemdeki tüm iş kayıtlarını, "şeflik + iş adı" bazında
   * gruplandırıp benchmark (standart süre) üretir. İKİ GEÇİŞLİ olmasının
   * sebebi: ham ortalama tek bir aşırı-uzun/kısa kayıttan kolayca
   * kirlenir (örn. biri yanlışlıkla 500 dk girerse, o grubun ortalaması
   * anlamsız şişer). Bu yüzden:
   *
   *   GEÇİŞ 1 (kirli ortalama ile ön tespit):
   *     Her (şeflik, iş) grubunun ham ortalaması hesaplanır, buna göre
   *     her kayıt geçici olarak sınıflandırılır (classifySapma).
   *
   *   GEÇİŞ 2 (temiz ortalama):
   *     GEÇİŞ 1'de "AŞIRI SAPMA" işaretlenen kayıtlar gruptan ÇIKARILIR,
   *     kalanlarla "temiz ortalama" yeniden hesaplanır. Nihai sapma,
   *     tempo ve uyarı bu temiz ortalamaya göre belirlenir.
   *
   *   İstisna: bir (şeflik, iş) kombinasyonunda tek kayıt varsa ("niş iş"),
   *   karşılaştıracak başka kayıt olmadığından kendi süresi kendi
   *   standardı kabul edilir (tempo=1, sapma=0).
   *
   * Her satıra şu alanlar eklenerek döndürülür:
   *   projRaw          : beyanDk / (tamamlanma/100)  -> "%100 bitseydi süresi ne olurdu"
   *   nis              : bu iş bu şeflikte tek kayıt mı?
   *   seflikOrt        : (temiz) grup ortalaması, projRaw cinsinden
   *   idealSure        : seflikOrt * (tamamlanma/100) -> bu tamamlanma yüzdesi için beklenen süre
   *   sapma            : (beyanDk - idealSure) / idealSure * 100
   *   tempo            : idealSure / beyanDk  (>1 = ortalamadan hızlı, <1 = yavaş)
   *   uyari            : classifySapma(sapma) sonucu (niş işler için "Niş İş (Standart)")
   *   nihaiStandartSure: beyanDk * tempo * 1.15  (PFD dahil, kadro/FTE hesabında kullanılır)
   *
   * @param {Array<Object>} tasks - Her eleman en az şunları içermeli:
   *        { seflik, anaIs, beyanDk, tamamlanma (0-100) }
   * @returns {Array<Object>} zenginleştirilmiş satırlar (girdiyle aynı sırada)
   *
   * @example
   * computeForDonem([
   *   {seflik:"A Şefliği", anaIs:"Rapor", beyanDk:60, tamamlanma:100},
   *   {seflik:"A Şefliği", anaIs:"Rapor", beyanDk:80, tamamlanma:100},
   *   {seflik:"A Şefliği", anaIs:"Rapor", beyanDk:500, tamamlanma:100}, // hatalı giriş
   * ])
   * // 500'lük kayıt "AŞIRI SAPMA!" olarak işaretlenir ve grup ortalamasından
   * // (60+80)/2 = 70 hesaplanır; 500'lük kayıt bu ortalamayı BOZMAZ.
   */
  function computeForDonem(tasks) {
    const rows = tasks.map((t) => Object.assign({}, t));

    // --- GEÇİŞ 1 ---
    rows.forEach((r) => {
      r.projRaw = r.beyanDk / (r.tamamlanma / 100);
    });

    const g1 = {};
    rows.forEach((r) => {
      const k = r.seflik + "|" + r.anaIs;
      (g1[k] = g1[k] || []).push(r);
    });

    Object.values(g1).forEach((grup) => {
      const nis = grup.length === 1;
      const ortRaw = mean(grup.map((x) => x.projRaw));
      grup.forEach((r) => {
        r.nis = nis;
        if (nis) {
          r.uyari1 = "Niş İş (Standart)";
        } else {
          const ideal1 = ortRaw * (r.tamamlanma / 100);
          const sapma1 = ideal1 > 0 ? ((r.beyanDk - ideal1) / ideal1) * 100 : 0;
          r.uyari1 = classifySapma(sapma1);
        }
      });
    });

    // --- GEÇİŞ 2: aşırı sapmalar dışlanarak temiz ortalama ---
    const g2 = {};
    rows.forEach((r) => {
      if (r.nis) return;
      if (r.uyari1 === "AŞIRI SAPMA! (Hatalı Giriş)") return;
      const k = r.seflik + "|" + r.anaIs;
      (g2[k] = g2[k] || []).push(r);
    });
    const cleanMean = {};
    Object.entries(g2).forEach(([k, grup]) => {
      cleanMean[k] = mean(grup.map((x) => x.projRaw));
    });

    rows.forEach((r) => {
      const k = r.seflik + "|" + r.anaIs;
      if (r.nis) {
        r.seflikOrt = r.beyanDk;
        r.idealSure = r.beyanDk;
        r.sapma = 0;
        r.tempo = 1;
        r.uyari = "Niş İş (Standart)";
      } else {
        // Temiz ortalama yoksa (grubun TÜM kayıtları aşırı sapmaysa) ham ortalamaya geri dön
        const ort = cleanMean[k] !== undefined ? cleanMean[k] : mean(g1[k].map((x) => x.projRaw));
        r.seflikOrt = ort;
        r.idealSure = ort * (r.tamamlanma / 100);
        r.sapma = r.idealSure > 0 ? ((r.beyanDk - r.idealSure) / r.idealSure) * 100 : 0;
        r.tempo = r.beyanDk > 0 ? r.idealSure / r.beyanDk : 1;
        r.uyari = classifySapma(r.sapma);
      }
      r.nihaiStandartSure = r.beyanDk * r.tempo * 1.15; // PFD (%15) dahil bütçe süresi
    });

    return rows;
  }

  // ================================================================
  // 4) KİŞİ BAZLI ORTALAMA TEMPO (Performans Skoru)
  // ================================================================
  /**
   * computeForDonem() çıktısından, her çalışanın aşırı-sapma kayıtları
   * HARİÇ tutularak ortalama tempo'sunu (performans skorunu) hesaplar.
   * Tempo > 1  -> ortalamadan hızlı/verimli
   * Tempo < 1  -> ortalamadan yavaş
   *
   * @param {Array<Object>} enrichedRows - computeForDonem() çıktısı, her
   *        satırda employeeId ve tempo alanı olmalı
   * @returns {Object<string|number, number>} employeeId -> ortalama tempo
   */
  function personTempoMap(enrichedRows) {
    const temiz = enrichedRows.filter((r) => r.uyari !== "AŞIRI SAPMA! (Hatalı Giriş)");
    const byEmp = {};
    temiz.forEach((r) => {
      (byEmp[r.employeeId] = byEmp[r.employeeId] || []).push(r.tempo);
    });
    const out = {};
    Object.entries(byEmp).forEach(([id, arr]) => {
      out[id] = mean(arr);
    });
    return out;
  }

  // ================================================================
  // 5) GÜNLÜK KRONOMETRAJ (PFD Kesintisi ve Kapasite Kullanımı)
  // ================================================================
  /**
   * Bir çalışanın tek bir gündeki net çalışma kapasitesini, PFD
   * (Personal, Fatigue, Delay -- yorgunluk/insani ihtiyaç payı) kesintisi
   * sonrası "saf beklenen çalışma süresine" çevirir ve o gün beyan edilen
   * iş süreleriyle karşılaştırıp bir "mutabakat oranı" üretir.
   *
   * PFD oranı %15 sabit kabul edilmiştir (endüstri mühendisliğinde
   * yaygın kullanılan bir kısayoldur; iş yerine göre ayarlanabilir).
   *
   *   net           = sureHesapla(bas, bit).net
   *   pfdKesinti    = net * 0.15
   *   safKapasite   = net * 0.85
   *   mutabakat (%) = islerdeGecenSure / safKapasite * 100
   *
   * mutabakat > 110% -> Kapasite Aşımı / Fazla Mesai (muhtemelen fazladan
   *                     iş yükü var ya da süreler yanlış giriliyor)
   * mutabakat < 80%  -> Atıl Kapasite (Boş Zaman)
   * aradaki bölge    -> Dengeli
   *
   * @param {string} baslangic - "HH:MM"
   * @param {string} bitis - "HH:MM"
   * @param {number} islerdeGecenSure - o gün girilen mikro işlerin toplam dakikası
   * @returns {{brut:number, yasalAra:number, net:number, pfdKesinti:number,
   *            safKapasite:number, islerdeGecen:number, mutabakat:number,
   *            durum:"Kapasite Aşımı / Fazla Mesai"|"Atıl Kapasite (Boş Zaman)"|"Dengeli"}}
   */
  function kronometraj(baslangic, bitis, islerdeGecenSure) {
    const { brut, yasalAra, net } = sureHesapla(baslangic, bitis);
    const pfdKesinti = net * 0.15;
    const safKapasite = net * 0.85;
    const mutabakat = safKapasite > 0 ? (islerdeGecenSure / safKapasite) * 100 : 0;

    let durum = "Dengeli";
    if (mutabakat > 110) durum = "Kapasite Aşımı / Fazla Mesai";
    else if (mutabakat < 80) durum = "Atıl Kapasite (Boş Zaman)";

    return { brut, yasalAra, net, pfdKesinti, safKapasite, islerdeGecen: islerdeGecenSure, mutabakat, durum };
  }

  // ================================================================
  // 6) NORM KADRO (FTE) HESABI
  // ================================================================
  /**
   * Bir şefliğin, dönem içindeki toplam "nihai standart süre" iş
   * yüküne göre kaç tam-zamanlı çalışana (FTE) ihtiyacı olduğunu
   * hesaplar ve mevcut çalışan sayısıyla karşılaştırır.
   *
   *   FTE  = toplam nihaiStandartSure / (işGünüSayısı * 480 dk)
   *   Fark = mevcutÇalışanSayısı - FTE
   *
   *   Fark < -0.5  -> "Eksik Kadro"     (iş yükü mevcut kadroyu aşıyor)
   *   Fark >  0.5  -> "Atıl Kapasite"   (kadro iş yükünden fazla)
   *   diğer        -> "Dengeli"
   *
   * NOT: nihaiStandartSure hesaplanırken aşırı-sapma kayıtları zaten
   * computeForDonem() içinde etkisiz kaldığından, burada ayrıca o
   * kayıtları filtrelemek isteğe bağlıdır (aşağıdaki örnekte yapılmıştır).
   *
   * @param {Array<Object>} enrichedRowsForSeflik - computeForDonem() çıktısından
   *        sadece ilgili şefliğe ait satırlar
   * @param {number} mevcutCalisanSayisi
   * @param {number} isGunuSayisi - dönemdeki iş günü sayısı (hafta sonu hariç)
   * @param {number} [gunlukKapasite=480] - bir kişinin günlük dakika kapasitesi (8 saat)
   * @returns {{isYuku:number, kapasite1Kisi:number, fte:number, fark:number,
   *            durum:"Eksik Kadro"|"Atıl Kapasite"|"Dengeli"}}
   */
  function fteHesapla(enrichedRowsForSeflik, mevcutCalisanSayisi, isGunuSayisi, gunlukKapasite) {
    gunlukKapasite = gunlukKapasite || 480;
    const temiz = enrichedRowsForSeflik.filter((r) => r.uyari !== "AŞIRI SAPMA! (Hatalı Giriş)");
    const isYuku = sum(temiz.map((r) => r.nihaiStandartSure));
    const kapasite1Kisi = isGunuSayisi * gunlukKapasite;
    const fte = kapasite1Kisi > 0 ? isYuku / kapasite1Kisi : 0;
    const fark = mevcutCalisanSayisi - fte;

    let durum = "Dengeli";
    if (fark < -0.5) durum = "Eksik Kadro";
    else if (fark > 0.5) durum = "Atıl Kapasite";

    return { isYuku, kapasite1Kisi, fte, fark, durum };
  }

  // ================================================================
  // DIŞA AKTARILAN API
  // ================================================================
  return {
    // istatistik yardımcıları
    mean,
    sum,
    // 1) zaman
    sureHesapla,
    // 2) sınıflandırma
    classifySapma,
    // 3) benchmark motoru (çekirdek)
    computeForDonem,
    // 4) kişi bazlı performans
    personTempoMap,
    // 5) günlük kronometraj
    kronometraj,
    // 6) norm kadro
    fteHesapla,
  };
});
