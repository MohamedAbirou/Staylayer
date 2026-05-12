import "@/styles/globals.css";
import "@puckeditor/core/puck.css";
import LanguageSelector from "@/components/LanguageSelector";

export default function App({ Component, pageProps }) {
  return (
    <>
      <div className="pointer-events-none fixed right-4 top-4 z-[1000] md:right-6 md:top-6">
        <div className="pointer-events-auto rounded-2xl border border-white/60 bg-white/85 p-2 shadow-lg shadow-slate-900/10 backdrop-blur-sm">
          <LanguageSelector />
        </div>
      </div>
      <Component {...pageProps} />
    </>
  );
}
