import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return (
    <div className="flex min-h-content justify-center pt-[20vh]">
      <SignIn />
    </div>
  );
}
