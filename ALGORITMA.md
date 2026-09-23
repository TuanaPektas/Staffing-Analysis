# OPTIWORK — Matematiksel Motor Açıklaması

Bu doküman, `optiwork-math-core.js` dosyasındaki formüllerin **neden** o
şekilde tasarlandığını, elle takip edilebilir örneklerle anlatır. Kod
dosyasını okumadan mantığı anlamak, ya da kodu okurken "bu satır neden
burada" sorusuna cevap bulmak için buraya bakabilirsiniz.

Her bölüm başlığının yanında, ilgili fonksiyonun adı `kod içinde` olarak
verilmiştir.

---

## 1. Günlük Net Çalışma Süresi — `sureHesapla()`

**Soru:** Bir çalışanın mesai başlangıç/bitiş saatinden, gerçekte ne kadar
"net" çalıştığını nasıl buluruz?

**Kural:** Bitiş saati öğleden (12:00) sonraysa, 90 dakika (60 dk yemek +
30 dk ek dinlenme) düşülür. Yarım gün mesaisi gibi bitişi 12:00'den önce
olan durumlarda ara düşülmez.

```
brüt      = bitiş - başlangıç
yasal_ara = bitiş > 12:00 ise 90 dk, değilse 0 dk
net       = brüt - yasal_ara
```

**Örnek:** 07:45 – 16:30 mesaisi
```
brüt = 16:30 - 07:45 = 525 dk
bitiş (16:30) > 12:00  →  yasal_ara = 90 dk
net = 525 - 90 = 435 dk
```

**Örnek 2 (ara düşülmeyen durum):** 08:00 – 11:30
```
brüt = 210 dk
bitiş (11:30) ≤ 12:00  →  yasal_ara = 0
net = 210 dk
```

---

## 2. Sapma Sınıflandırması — `classifySapma()`

Bir çalışanın bir iş için beyan ettiği süre, o işin "beklenen" (ortalama)
süresinden ne kadar farklıysa, buna **sapma yüzdesi** diyoruz:

```
sapma% = (beyan_edilen - beklenen) / beklenen × 100
```

Bu yüzdeye göre üç seviyeli bir uyarı üretilir. Eşikler **asimetriktir**
— çünkü bir işi ortalamadan çok hızlı bitirmek (muhtemelen atlanmış
adımlar) ile çok yavaş bitirmek (muhtemelen ek karmaşıklık) farklı
şeylere işaret eder:

| Sapma Aralığı | Uyarı |
|---|---|
| sapma > %200 **veya** sapma < −%80 | 🔴 AŞIRI SAPMA! (Hatalı Giriş) |
| %75 < sapma ≤ %200 **veya** −%80 ≤ sapma < −%50 | 🟡 İncelenebilir |
| −%50 ≤ sapma ≤ %75 | 🟢 Sorun Yok |

---

## 3. İki Geçişli Benchmark Motoru — `computeForDonem()`

Bu, sistemin **kalbi**. Amaç: her (şeflik, iş) kombinasyonu için "normal
bir çalışanın bu işi kaç dakikada yaptığı" standardını, veri içindeki
hatalı/aşırı girişlerden etkilenmeden bulmak.

### Neden "iki geçişli"?

Basit bir ortalama, tek bir hatalı kayıttan kolayca bozulur:

> Bir şeflikte "Aylık Rapor" işi için 3 kayıt var: 60 dk, 80 dk, ve
> yanlışlıkla girilmiş 500 dk. Basit ortalama = **213 dk** — gerçek
> standarttan (≈70 dk) çok uzak. Bu yanlış "213 dk" standardı, o işi
> gerçekten 60-80 dk'da yapan herkesi "çok hızlı çalışıyor" gibi
gösterir.

**Çözüm — iki geçiş:**

**Geçiş 1 (kirli ortalama ile ön tespit):**
Tüm kayıtlarla ham bir ortalama (`ortRaw`) hesaplanır, her kayıt bu
ortalamaya göre geçici olarak sınıflandırılır (`classifySapma`).

**Geçiş 2 (temiz ortalama):**
Geçiş 1'de "AŞIRI SAPMA" işaretlenen kayıtlar gruptan **çıkarılır**,
kalanlarla "temiz ortalama" (`cleanMean`) yeniden hesaplanır. Nihai
sapma, tempo ve uyari etiketleri artık bu temiz ortalamaya göre belirlenir.

**Niş iş istisnası:** Bir (şeflik, iş) kombinasyonunda karşılaştıracak
başka kayıt yoksa (tek kayıt), kendi süresi kendi standardı kabul edilir
(`tempo = 1`, `sapma = 0`, uyarı = "Niş İş (Standart)").

### Üretilen alanlar

| Alan | Anlamı |
|---|---|
| `projRaw` | `beyanDk / (tamamlanma/100)` → "%100 bitseydi süresi ne olurdu" |
| `seflikOrt` | (temiz) grup ortalaması |
| `idealSure` | `seflikOrt × (tamamlanma/100)` → bu tamamlanma % için beklenen süre |
| `sapma` | `(beyanDk − idealSure) / idealSure × 100` |
| `tempo` | `idealSure / beyanDk` (>1 hızlı, <1 yavaş) |
| `nihaiStandartSure` | `beyanDk × tempo × 1.15` → PFD dahil, kadro (FTE) hesabında kullanılan "bütçe süresi" |

### ⚠️ Bilinen sınırlama: küçük örneklem

Yukarıdaki örneği gerçek fonksiyonla çalıştırdığımızda:

```js
computeForDonem([
  {employeeId:1, seflik:'A', anaIs:'Rapor', beyanDk:60,  tamamlanma:100},
  {employeeId:2, seflik:'A', anaIs:'Rapor', beyanDk:80,  tamamlanma:100},
  {employeeId:3, seflik:'A', anaIs:'Rapor', beyanDk:500, tamamlanma:100},
])
```

500'lük kayıt **AŞIRI SAPMA olarak yakalanmıyor** (sadece "İncelenebilir"
çıkıyor). Sebep: Geçiş 1'deki kirli ortalama (213.3) zaten 500'ün
etkisiyle şişmiş durumda; 500'ün bu şişmiş ortalamaya göre sapması
(%134) eşiği (%200) aşmıyor. Yani aykırı değer, kendi tespit edilmesini
gereken ortalamayı bozarak "gizleniyor".

**Pratik sonucu:** Bu algoritma, her (şeflik, iş) grubunda **yeterince
çok kayıt** (pratikte 5-10+) olduğunda güvenilir çalışır — çünkü o zaman
tek bir aykırı değerin ortalamayı bozma gücü azalır. Az kayıtlı niş
işlerde ekstra manuel kontrol önerilir. Bu, kodun bir hatası değil,
istatistiksel yöntemin doğasında olan bir durumdur; dokümantasyonda
belirtilmesi gereken önemli bir varsayımdır.

---

## 4. Kişi Bazlı Performans Skoru — `personTempoMap()`

Bir çalışanın tüm işlerdeki **ortalama tempo**su (aşırı sapma kayıtları
hariç tutularak), o kişinin genel performans skorunu verir:

```
performans_skoru(kişi) = ortalama(tempo değerleri, AŞIRI SAPMA hariç)
```

`tempo > 1` → ortalamadan hızlı/verimli
`tempo < 1` → ortalamadan yavaş

---

## 5. Günlük Kronometraj ve PFD Kesintisi — `kronometraj()`

**PFD** (Personal, Fatigue, Delay), endüstri mühendisliğinde yaygın
kullanılan bir kavramdır: bir çalışanın gününün bir kısmının, doğrudan
üretken işe değil, insani ihtiyaçlara (mola, yorgunluk, küçük gecikmeler)
gitmesi beklenir. Bu sistemde **sabit %15** olarak kabul edilmiştir.

```
net           = sureHesapla(başlangıç, bitiş).net
pfd_kesinti   = net × 0.15
saf_kapasite  = net × 0.85
mutabakat %   = işlerde_geçen_süre / saf_kapasite × 100
```

| Mutabakat | Durum |
|---|---|
| > %110 | Kapasite Aşımı / Fazla Mesai |
| < %80 | Atıl Kapasite (Boş Zaman) |
| %80 – %110 | Dengeli |

**Örnek:** 07:45–16:30 mesaisi (net 435 dk), o gün işlerde 300 dk geçmiş:
```
saf_kapasite = 435 × 0.85 = 369.75 dk
mutabakat    = 300 / 369.75 × 100 ≈ %81.1  →  Dengeli
```

---

## 6. Norm Kadro (FTE) Hesabı — `fteHesapla()`

Bir şefliğin, mevcut iş yüküne göre **kaç tam-zamanlı çalışana** ihtiyacı
olduğunu (Full-Time Equivalent) hesaplar:

```
FTE  = toplam(nihaiStandartSure) / (iş_günü_sayısı × 480 dk)
fark = mevcut_çalışan_sayısı − FTE
```

| Fark | Durum |
|---|---|
| < −0.5 | Eksik Kadro (iş yükü kadroyu aşıyor) |
| > +0.5 | Atıl Kapasite (kadro iş yükünden fazla) |
| −0.5 ile +0.5 arası | Dengeli |

480 dakika = 8 saatlik tam mesai günü varsayımıdır; farklı bir mesai
düzeni için bu parametre değiştirilebilir (`fteHesapla` fonksiyonunun 4.
parametresi).

---

## Formüllerin Kod İçindeki Konumu

| Bölüm | Fonksiyon | Dosya |
|---|---|---|
| 1 | `sureHesapla()` | `optiwork-math-core.js` |
| 2 | `classifySapma()` | `optiwork-math-core.js` |
| 3 | `computeForDonem()` | `optiwork-math-core.js` |
| 4 | `personTempoMap()` | `optiwork-math-core.js` |
| 5 | `kronometraj()` | `optiwork-math-core.js` |
| 6 | `fteHesapla()` | `optiwork-math-core.js` |

Dashboard HTML dosyasındaki aynı isimli fonksiyonlar, bu saf
fonksiyonların DOM'a ve global değişkenlere bağlı (impure) versiyonlarıdır
— render fonksiyonları global `TASKS`/`EMPLOYEES` dizilerinden veri okuyup
bu hesaplamaları yapar ve sonucu tabloya basar. Mantığı değiştirmek
istediğinizde, önce burada (saf fonksiyonlarda) değiştirip test etmeniz,
sonra dashboard'a taşımanız önerilir.
