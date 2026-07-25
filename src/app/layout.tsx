import type { Metadata } from "next";
import { Geist, Geist_Mono, Teko } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const teko = Teko({
  variable: "--font-score",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Badminton Mabar",
  description: "Aplikasi manajemen main badminton bareng",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${teko.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem("user");
                  if (raw) {
                    var u = JSON.parse(raw);
                    var p = u.primaryColor || (u.pb && u.pb.primaryColor) || "#0d9488";
                    var c = u.captionColor || "#0d9488";
                    var b = u.bgColor || "#f0fdfa";
                    function darken(hex, amt) {
                      var num = parseInt(hex.replace("#", ""), 16);
                      var r = Math.max(0, (num >> 16) - amt);
                      var g = Math.max(0, ((num >> 8) & 0xff) - amt);
                      var bl = Math.max(0, (num & 0xff) - amt);
                      return "#" + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0");
                    }
                    function lighten(hex, amt) {
                      var num = parseInt(hex.replace("#", ""), 16);
                      var r = Math.min(255, (num >> 16) + amt);
                      var g = Math.min(255, ((num >> 8) & 0xff) + amt);
                      var bl = Math.min(255, (num & 0xff) + amt);
                      return "#" + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0");
                    }
                    var root = document.documentElement;
                    root.style.setProperty("--color-primary", p);
                    root.style.setProperty("--color-primary-hover", darken(p, 20));
                    root.style.setProperty("--color-primary-light", lighten(p, 180));
                    root.style.setProperty("--color-primary-lighter", lighten(p, 220));
                    root.style.setProperty("--color-primary-ring", p + "1a");
                    root.style.setProperty("--color-caption", c);
                    root.style.setProperty("--color-caption-hover", darken(c, 30));
                    root.style.setProperty("--color-bg", b);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
