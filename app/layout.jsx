
import "./globals.css";

export const metadata = {
  title: "Forstant Insights for Kailent",
  description:
    "A disciplined view of Kailent's reach, engagement, growth, and impact.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
