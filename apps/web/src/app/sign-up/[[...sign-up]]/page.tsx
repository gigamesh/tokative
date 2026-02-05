import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-content justify-center pt-[20vh]">
      <SignUp />
    </div>
  );
}
