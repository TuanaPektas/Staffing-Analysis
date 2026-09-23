# Staffing-Analysis
A web-based HR optimization tool for Staffing Analysis. Includes a daily micro-task timesheet for employees and an FTE benchmarking dashboard for managers.

# OPTIWORK | Staffing Analysis & Workforce Optimization

OPTIWORK is a web-based HR optimization tool designed for corporate human resources departments. It measures daily employee effort and provides managers with comprehensive **FTE (Full-Time Equivalent)** and staffing benchmark analyses. 

The project operates entirely on the client side (browser-based) and consists of two main interfaces, requiring no server or database installation.

## 📂 Project Structure & Features

### 1. Employee Timesheet (`index.html`)
A daily data entry panel where employees log their micro-tasks, categories, and time spent.
* **Time & Capacity Calculation:** Automatically calculates net working capacity by deducting legal breaks (meal and rest) based on shift start and end times[span_0](start_span)[span_0](end_span).
* **Micro-Task Tracking:** Allows users to log specific sub-tasks under main categories such as recruitment, reporting, and communication[span_1](start_span)[span_1](end_span).
* **Local Storage:** Daily timesheets and historical leave/absence records are saved directly to the browser's `localStorage`[span_2](start_span)[span_2](end_span).
* **Dynamic Parameters:** Incorporates employee profile variables (age, seniority, work model) to account for learning curves and capacity factors[span_3](start_span)[span_3](end_span).

### 2. Manager Dashboard (`yonetici.html`)
A calibration and benchmark dashboard where employee data is consolidated to detect staffing shortages or idle capacities.
* **FTE Analysis:** Calculates the ideal FTE by dividing the monthly workload of a specific department by a single employee's monthly capacity (Monthly Work Days × 480 Mins)[span_4](start_span)[span_4](end_span).
* **Synthetic Data Generation:** Upon loading, the system generates thousands of rows of realistic test data for a 3-month period, utilizing Gaussian distribution (standard deviation) and seniority/age multipliers[span_5](start_span)[span_5](end_span).
* **Outlier Detection (Extreme Deviation):** Compares reported task durations with department averages to flag and exclude "Extreme Deviation" records from core calculations[span_6](start_span)[span_6](end_span).
* **Productivity Radar:** Identifies employees with a capacity utilization rate above 90% (Critical Workload) and below 60% (Idle Capacity)[span_7](start_span)[span_7](end_span).
* **Demographic Benchmarking:** Displays performance and tempo averages across different demographic breakdowns (age range, gender, seniority) using bar charts[span_8](start_span)[span_8](end_span).

## 🚀 Installation & Usage
This project is entirely client-side.
1. Clone or download the repository as a ZIP file.
2. Open the HTML files in any modern web browser (Chrome, Safari, Edge).
3. The UI automatically adapts to your system's Dark Mode or Light Mode preferences[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).

## 🛠️ Technologies Built With
* HTML5
* CSS3 (CSS Grid, Flexbox, Responsive Design, CSS Variables)[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span)
* Vanilla JavaScript (ES6+, LocalStorage API)[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span)
* **Zero Dependencies:** No external libraries or frameworks are required.

* ## Live Demo

- **Employee Timesheet:** https://tuanapektas.github.io/Staffing-Analysis/
- **Manager Dashboard:** https://tuanapektas.github.io/Staffing-Analysis/yonetici.html

Both screens are standalone HTML files and run directly in the browser.


