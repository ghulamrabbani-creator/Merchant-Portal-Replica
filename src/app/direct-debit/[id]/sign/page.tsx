// Moved 25-Sep-2026: the customer's review & signing page now lives at /contracts/review/{id}
// (the Geidea-hosted review URL in Backend Stories S2 §6.1), behind the OTP verification screen.
// This route only redirects, so older links keep working.

import { redirect } from "next/navigation";

export default async function LegacySignRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/contracts/review/${id}`);
}
