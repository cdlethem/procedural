import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">Missing study</p>
      <h1>This work is not in the collection.</h1>
      <Link className="button" href="/">
        Return to gallery
      </Link>
    </main>
  );
}
