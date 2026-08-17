import { Card, CardContent } from '@/components/ui/card'

export function SettingsPlaceholderTab({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <Card className="-mx-4 rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
      <CardContent className="px-5 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        <div className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This settings section will be available in an upcoming update.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
