
import "./globals.css";

export const metadata = {
  title: "Forstant Insights for Kailent",
  description: "Kailent growth analytics by Forstant Labs.",
  applicationName: "Forstant Insights for Kailent",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
