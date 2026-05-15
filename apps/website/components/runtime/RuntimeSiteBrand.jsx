function getLogoAlt(site) {
  const name = site?.name || "Customer site";
  return `${name} logo`;
}

export function RuntimeSiteBrand({ site }) {
  const logoUrl = site?.theme?.logoUrl;

  if (!logoUrl) {
    return null;
  }

  return (
    <header className="border-b border-slate-100 bg-white/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center no-underline">
          <img
            src={logoUrl}
            alt={getLogoAlt(site)}
            className="block max-h-10 max-w-44 object-contain"
          />
        </a>
      </div>
    </header>
  );
}
