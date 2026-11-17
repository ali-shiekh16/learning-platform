import { PageHeader } from '@/components/page-header'
import { TtsPanel } from '@/components/tts/tts-panel'
import { Card, CardContent } from '@/components/ui/card'

/** /tools/tts: the text-to-speech tool on its own page. */
export function TtsPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Text to speech"
        description="Paste any text and listen to it, with the voices your browser offers. The text stays on your device."
      />
      <Card>
        <CardContent>
          <TtsPanel />
        </CardContent>
      </Card>
    </div>
  )
}
