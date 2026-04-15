# PDF Comparison Tool

A client-side PDF comparison tool built with Next.js that allows users to compare two PDF files visually and textually.

## Features

- **Visual Comparison**: Compare PDFs page-by-page with pixel-level difference detection
- **Text Comparison**: Extract and compare text content from PDFs
- **Client-Side Processing**: All processing happens in the browser - no server uploads required
- **Modern UI**: Built with Next.js and Tailwind CSS for a responsive, modern interface

## Technologies Used

- **Next.js 16.2.3**: React framework for production
- **React 19.2.5**: UI library
- **PDF.js 5.6.205**: PDF rendering and text extraction
- **Pixelmatch 7.1.0**: Pixel-level image comparison
- **Diff 9.0.0**: Text difference detection
- **Tailwind CSS 4.2.2**: Utility-first CSS framework

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/pdf_comparison_tool.git
cd pdf_comparison_tool
```

2. Install dependencies:
```bash
npm install
```

## Running Locally

### Development Mode

Start the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

Build the application for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Usage

1. Open the application in your browser
2. Upload two PDF files you want to compare
3. View the visual differences highlighted on each page
4. Review text differences in the text comparison view
5. Navigate between pages to see all differences

## Project Structure

```
pdf_comparison_tool/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.js            # Root layout component
│   ├── page.js              # Main page component
│   └── pdf-compare-client.js # PDF comparison logic
├── public/                  # Static assets
├── .gitignore              # Git ignore rules
├── eslint.config.mjs       # ESLint configuration
├── jsconfig.json           # JavaScript configuration
├── next.config.mjs         # Next.js configuration
├── package.json            # Project dependencies
├── postcss.config.mjs      # PostCSS configuration
└── README.md               # This file
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.