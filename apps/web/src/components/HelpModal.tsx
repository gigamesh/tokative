import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand/20 text-brand flex items-center justify-center text-sm font-semibold">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <h3 className="font-medium text-foreground mb-1">{title}</h3>
        <p className="text-foreground-muted">{children}</p>
      </div>
    </div>
  );
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <h2 className="text-xl font-semibold text-foreground mb-1">
        How to use Tokative
      </h2>

      <div className="space-y-5 text-sm mt-6">
        <Step number={1} title="Scrape Profile">
          Start by going to a TikTok profile page. Open the extension and click
          &quot;Scrape Profile&quot;.
        </Step>

        <Step number={2} title="Scrape Comments">
          Select any of the posts in the posts tab, then click Fetch Comments.
          TikTok will open in a new browser tab and you&apos;ll see all the
          comments getting loaded. You&apos;ll need to keep this tab open until
          the process completes.
        </Step>

        <Step number={3} title="Reply to Comments">
          If you're signed in to TikTok, you can reply to comments individually
          or in bulk. If you are replying to many comments at once, it is
          strongly encouraged to use multiple reply variations.
        </Step>

        <div className=" border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400">
            <span className="font-semibold">⚠️ Important:</span> TikTok has
            sensitive spam detection. If you reply to too many comments in a
            short amount of time with the same message, TikTok may suspend your
            account.
          </p>
        </div>
      </div>

      <Button
        onClick={onClose}
        variant="primary"
        size="lg"
        fullWidth
        className="mt-6"
      >
        Got it
      </Button>
    </Modal>
  );
}
