export default function OrderList({ list, grid = "" }) {
  return (
    <ol className={`space-y-8 max-w-2xl mx-auto mt-12 ${grid}`}>
      {list.map((step, idx) => (
        <li key={idx} className="flex items-start gap-4">
          <span className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-700">
            {idx + 1}
          </span>
          <div>
            <div className="text-lg font-semibold mb-1">{step.title}</div>
            {step.description && (
              <p className="text-base text-slate-700">{step.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
