import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { Rosette } from "@/components/rosette";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const callbackUrl = (formData.get("callbackUrl") as string) || "/";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
      throw err;
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <Rosette size={34} />
          <div>
            <div className="login-title">Tribal Gaming Compliance &amp; Licensing Platform</div>
            <div className="login-sub">System of Record · V1</div>
          </div>
        </div>

        {params.error ? (
          <div className="login-error">Incorrect email or password. Please try again.</div>
        ) : null}

        <form action={login}>
          <input type="hidden" name="callbackUrl" value={params.callbackUrl || "/"} />
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" placeholder="you@agency.gov" />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
            Sign In
          </button>
        </form>

        <div className="login-demo-accounts">
          <div>Demo accounts (password: <span className="mono">demo-pass-2026</span>):</div>
          <div className="mono">compliance@demo.gov</div>
          <div className="mono">licensing@demo.gov</div>
          <div className="mono">applicant@demo.gov</div>
        </div>
      </div>
    </div>
  );
}
