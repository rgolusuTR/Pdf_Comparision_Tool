import "./globals.css";

export const metadata = {
  title: "PDF Comparison Tool",
  description: "Compare two PDF files directly in the browser",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
