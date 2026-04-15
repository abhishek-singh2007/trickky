import Link from "next/link";

export default async function ProfilePage({ params }) {
  const { id } = await params;

  return (
    <div className="page-wrap">
      <main className="profile-card">
        <h1>Profile</h1>

        <dl className="profile-grid">
          <dt>Profile ID</dt>
          <dd>{id}</dd>

          <dt>Name</dt>
          <dd>Demo User</dd>

          <dt>Email</dt>
          <dd>demo.user@example.com</dd>

          <dt>Status</dt>
          <dd>UI Preview Mode</dd>
        </dl>

        <Link href="/">Back to login</Link>
      </main>
    </div>
  );
}