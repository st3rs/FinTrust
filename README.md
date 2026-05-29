<div align="center">
  <img src="https://via.placeholder.com/150x150/6366f1/ffffff?text=InvoicePro" alt="InvoicePro Logo" width="120" height="120" style="border-radius: 24px; margin-bottom: 20px;" />
  
  <h1 align="center">InvoicePro Dashboard</h1>
  <p align="center">
    <strong>A modern, high-performance financial operating system for modern freelancers and agencies.</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </p>
</div>

<br />

## 🌟 Overview

InvoicePro is a comprehensive, full-stack invoicing and client management dashboard. It breaks down the barriers of traditional invoicing by natively supporting modern payment methods including **Crypto**, **Cards**, and **PromptPay QR Codes**. Built with speed, aesthetic design, and developer experience in mind.

<div align="center">
  <img src="https://via.placeholder.com/800x450/1e293b/ffffff?text=Dashboard+Preview" alt="Dashboard Preview" style="border-radius: 12px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
</div>

<br />

## ✨ Features

- 📊 **Beautiful Real-time Dashboard:** Track revenue metrics, recent payments, and client growth with interactive D3/Recharts visualizations.
- 👥 **Advanced Client Management:** Add and manage clients, track lifetime value, and view custom statuses. 
- 📱 **Instant PromptPay QR Codes:** Generate dynamic PromptPay QR codes for quick mobile banking payments in Thailand and Southeast Asia.
- 💳 **Poly-payment Support:** Invoices present options for standard fiat Card payments, direct Crypto wallet transfers, and regional QR rails.
- 🛠 **Developer API Docs:** A dedicated section mapping out internal data structures and endpoints.
- 🎨 **Minimalist Design & Interactivity:** Refined aesthetics utilizing Tailwind CSS and buttery-smooth micro-interactions from Framer Motion.
- 🌓 **Dark/Light Mode Ready:** First-class support for system-preference themes out of the box.

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/invoicepro.git
cd invoicepro
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## 📂 Project Structure

```text
├── src/
│   ├── components/       # Reusable UI elements (Shadcn + custom layout)
│   ├── lib/              # Utility functions (PromptPay generator, formatting)
│   └── App.tsx           # React router setup and root composition
├── components/           # Shadcn base root definitions
├── server.ts             # Express backend providing serving logic
└── index.html            # Main App Entry
```

## 🛠 Tech Stack

- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + custom OKLCH colors
- **Components:** Radix UI primitives with full accessibility
- **Animations:** Framer Motion
- **Charting:** Recharts
- **Icons:** Lucide React

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
<p align="center">Built with 🖤 by the InvoicePro Team.</p>
