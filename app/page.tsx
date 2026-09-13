import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-800">
        Cog Trials
      </p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
        A clearer view of cognitive health research.
      </h1>
      <p className="mt-6 text-lg leading-8 text-slate-600">
        Cog Trials brings publicly available clinical trial information about
        dementia and cognitive disorders together in one place.
      </p>
      <Link
        href="/trials"
        className="mt-8 inline-flex rounded-md bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-900"
      >
        View trials <span aria-hidden="true" className="ml-2">→</span>
      </Link>
      <section aria-labelledby="project-status" className="mt-16 border-t border-slate-200 pt-8">
        <h2 id="project-status" className="text-lg font-semibold">About the collection</h2>
        <p className="mt-3 leading-7 text-slate-600">
          The collection uses publicly available records from ClinicalTrials.gov.
          View the trials page to see the search terms and latest saved studies.
        </p>
      </section>
    </div>
  );
}
