# InvigilateIQ v2.0

**Smart Exam Duty Scheduler**

A powerful web application for efficiently scheduling invigilators (exam proctors) across exam dates, rooms, and shifts based on teacher availability, age preferences, and equal duty distribution.

## Features

- 📊 **Data Upload**: Import teacher lists and room details via Excel or CSV files
- ⚙️ **Configuration**: Set exam dates, assign shifts (morning/evening), and manage room details
- 🔄 **Smart Scheduling**: Automatic load balancing using:
  - Age-based floor assignment (oldest teachers to lowest floors)
  - Equal duty distribution across all teachers
  - Morning & evening shift optimization
- 📥 **Multiple Export Modes**:
  - Full schedule (all assignments)
  - Teacher-wise report
  - Room-wise report

## Quick Start

1. Open `index.html` in a web browser
2. Upload your teacher and room data (Excel/CSV format)
3. Configure exam dates and shifts
4. Generate the schedule
5. Export results in your preferred format

## File Structure

- `index.html` - Main application interface
- `app.js` - Core scheduling logic and functionality
- `style.css` - UI styling and responsive design

## Technologies

- HTML5 / CSS3
- JavaScript (Vanilla)
- XLSX library for Excel parsing

## License

MIT
