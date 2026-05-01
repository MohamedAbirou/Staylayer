export function OnePlanFeaturesTable() {
  const features = [
    { name: "Multi channel calendar sync", desc: "Airbnb, Booking com, Vrbo, Expedia, and your direct site all stay aligned. No double bookings." },
    { name: "Direct booking website", desc: "Fast site with your brand and your domain. Real time rates and availability. No commissions." },
    { name: "Dynamic pricing", desc: "Rates react to demand, season, local events, and lead time. Better occupancy. Better revenue." },
    // { name: "Unified inbox", desc: "Every guest message in one place with quick replies and simple templates." },
    { name: "Automated guest messaging", desc: "Welcome notes, check in guides, door codes, and review requests go out on time." },
    // { name: "Cleaning and turns", desc: "Auto create tasks, share a cleaner view, track status, and avoid misses." },
    // { name: "Maintenance tickets", desc: "Log issues with photos, set priority, assign work, and keep a clear history." },
    // { name: "Quotes and holds", desc: "Build a quote in seconds. Add taxes and fees. Send a pay link or hold dates." },
    { name: "Secure payments", desc: "Cards and bank transfers with fraud checks and instant receipts." },
    // { name: "Damage deposits", desc: "Place and release holds on a schedule. Set rules per property." },
    // { name: "Smart lock links", desc: "Time bound codes for guests and cleaners with zero extra effort." },
    { name: "Guest ID checks", desc: "Light touch identity steps that cut risk and protect the home." },
    { name: "House rules and guidebook", desc: "WiFi, parking, and appliance tips in a clean mobile view." },
    { name: "Taxes and fees", desc: "City tax, cleaning fees, pet fees, extra guest rules set once and applied every time." },
    { name: "Owner statements", desc: "Clear monthly statements with splits and notes for expenses." },
    { name: "Owner payouts", desc: "Simple payout runs that match your bank schedule." },
    { name: "Revenue and occupancy reports", desc: "See average rate, booking window, length of stay, and channel mix." },
    { name: "Bulk rate updates", desc: "Change a season or a group of homes in one pass and push everywhere." },
    { name: "Gap filler", desc: "Nudge short stays to fill awkward gaps without hurting clean time." },
    { name: "Channel specific pricing", desc: "Fine tune rates per marketplace and keep your direct edge." },
    // { name: "Mobile app", desc: "Update rates, reply to guests, and approve tasks from your phone." },
    { name: "User roles", desc: "Give managers, cleaners, and owners the right access. Nothing more." },
    { name: "Photo manager", desc: "Keep a fresh gallery that loads fast and converts better." },
    // { name: "Add ons and upsells", desc: "Parking, late checkout, baby crib, and local deals that add revenue." },
    { name: "Channel coverage", desc: "Airbnb, Booking com, Vrbo, Expedia, Google Vacation Rentals, and more." },
    { name: "Availability rules", desc: "Min nights, max nights, lead time, and turn day rules that fit your ops." },
    { name: "Hold windows", desc: "Give your team breathing room before and after high value stays." },
    { name: "Owner portal", desc: "Owners can see bookings, payouts, and notes without support tickets." },
    { name: "Task comments", desc: "Short updates with photos so nothing gets lost." },
    { name: "Reporting exports", desc: "Send clean CSV files to your accountant in a click." },
    { name: "API access", desc: "Connect the tools you love and build light automations." },
    { name: "Email templates", desc: "Plain language messages that guests actually read." },
    { name: "Support from real people", desc: "Quick answers from folks who know hosting." }
  ];

  return (
    <section className="mx-auto my-12 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          One plan. Full vacation rental software.
        </h2>
        <p className="mt-3 text-gray-600">
          Channel manager, property management, direct booking site, and simple revenue tools in one clear plan.
          No tiers. No guesswork. Just what you need to run smarter and earn more.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate" style={{ borderSpacing: 0 }}>
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-medium text-gray-700">Feature</th>
                <th className="px-5 py-4 text-left text-sm font-medium text-gray-700">What you get</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {features.map((f, i) => (
                <tr
                  key={f.name}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-5 py-4 align-top font-medium">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                        ✓
                      </span>
                      <span>{f.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top text-gray-700">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-5 py-5">
          <p className="text-sm text-gray-600">
            Built for hosts and managers who want less busy work and more direct bookings.  
            Works across major channels, supports smart pricing, and keeps operations tight from inquiry to payout.
          </p>
        </div>
      </div>
    </section>
  );
}
