# 🎓 Education Management Panel

**Artı Akademi – Education Management Web Panel**

A web-based management system developed for real-world use by an educational institution.

The platform brings together student and teacher management, lesson scheduling, packages, payments, financial tracking, teacher earnings, reporting, and administrative workflows in a single interface.

The project was initially developed during my software development internship and continues to be improved as a personal software engineering project.

---

## 🚀 Features

- Student management
- Teacher management
- Individual and group lesson scheduling
- Student package management
- Lesson status and make-up lesson tracking
- Payment and collection tracking
- Income and expense management
- Teacher earnings calculation
- Administrative reporting
- PDF and Excel export
- Authentication and user management
- Role-based data access
- Responsive administrative interface

---

## 🛠️ Tech Stack

### Frontend
- React
- JavaScript
- Vite
- Tailwind CSS

### Backend & Database
- Supabase
- PostgreSQL
- Supabase Authentication
- Supabase Storage
- Row Level Security (RLS)

### Tools
- Git
- GitHub
- Postman
- VS Code

---

## 💻 Technical Highlights

- Relational database design with PostgreSQL
- CRUD operations across multiple application modules
- Authentication and role-based access control
- Supabase Row Level Security (RLS)
- Private file storage
- Asynchronous data handling
- Reusable React components
- Server-side data listing and pagination
- Form validation and application state management
- Financial calculations and reporting
- PDF and Excel export functionality
- Testing and debugging with real-world workflows

---

## 📊 Main Modules

### Students
Manages student records, active/passive status, packages, payment information, and related educational data.

### Teachers
Manages teacher information, specialties, assigned students, lesson data, and teacher earnings.

### Lesson Scheduling
Handles lesson plans, lesson statuses, group lessons, and make-up lessons.

### Payments
Tracks student payments, payment periods, due dates, partial payments, and payment statuses.

### Finance
Manages income, expenses, teacher payments, and financial summaries.

### Reports
Provides administrative reports and PDF/Excel data export functionality.

---

## 🔐 Security

The application uses:

- Supabase Authentication
- PostgreSQL Row Level Security (RLS)
- Role-based data access
- Private storage for uploaded files
- Environment variables for configuration and credentials

Sensitive credentials and environment files are not included in this repository.

---

## 📸 Screenshots

Application screenshots will be added here.

<!--
![Dashboard](docs/screenshots/dashboard.png)
![Students](docs/screenshots/students.png)
![Finance](docs/screenshots/finance.png)
-->

---

## 🗺️ Roadmap / Future Improvements

The current version uses Supabase for backend services and PostgreSQL for data storage.

One of the main goals of the next development phase is to replace the Backend-as-a-Service approach with a custom backend architecture.

Planned improvements:

- [ ] Replace Supabase backend services with a custom backend
- [ ] Build a REST API using Node.js and Express.js
- [ ] Connect the backend directly to PostgreSQL
- [ ] Move business logic from the client to the backend
- [ ] Implement custom authentication and authorization
- [ ] Add centralized validation and error handling
- [ ] Add automated tests
- [ ] Improve backend and frontend architecture
- [ ] Add API documentation
- [ ] Introduce CI/CD workflows
- [ ] Improve performance and code splitting
- [ ] Expand reporting and analytics features

The long-term goal is to transform the project into a more independent and scalable full-stack architecture while gaining deeper hands-on experience with backend development.

---

## ⚙️ Local Development

Clone the repository:

```bash
git clone https://github.com/ceydagezer/education-management-panel.git
cd education-management-panel
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

---

## 📌 Project Status

The application is functional and has been tested using real-world administrative workflows.

Development is ongoing. The next major technical goal is migrating from Supabase-managed backend services to a custom Node.js/Express backend connected directly to PostgreSQL.

---

## 👩‍💻 Developer

**Ceyda Gezer**  
Fourth-Year Computer Engineering Student
