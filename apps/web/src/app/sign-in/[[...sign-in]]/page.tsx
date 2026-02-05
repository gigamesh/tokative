import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-content justify-center pt-[20vh]">
      <SignIn />
    </div>
  );
}
