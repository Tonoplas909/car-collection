import { Component, input, output } from '@angular/core'
import { RouterLink } from '@angular/router'

export interface EmptyAction { label: string; to?: string }

const TONE = {
  dark: { background: 'var(--color-text)', color: 'var(--color-bg)' },
  grey: { background: 'var(--color-neutral-300)', color: 'var(--color-text)' },
  red: { background: 'var(--color-accent)', color: 'var(--color-bg)' },
}

/** Empty / error state (States 9a–9d): tone block with a glyph, title, text, primary and secondary actions. */
@Component({
  selector: 'app-empty-state',
  host: { class: 'empty' },
  imports: [RouterLink],
  template: `
    <div class="empty-glyph" [style]="tones[tone()]"><span>{{ glyph() }}</span></div>
    <div class="empty-body">
      <span class="t">{{ title() }}</span>
      <span class="d">{{ text() }}</span>
      <div class="acts">
        @if (cta().to) { <a class="btn btn-dark" [routerLink]="cta().to">{{ cta().label }}</a> }
        @else { <button type="button" class="btn btn-dark" (click)="ctaClick.emit()">{{ cta().label }}</button> }
        @if (alt(); as a) {
          @if (a.to) { <a class="btn btn-outline" [routerLink]="a.to">{{ a.label }}</a> }
          @else { <button type="button" class="btn btn-outline" (click)="altClick.emit()">{{ a.label }}</button> }
        }
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly glyph = input.required<string>()
  readonly tone = input<keyof typeof TONE>('dark')
  readonly title = input.required<string>()
  readonly text = input.required<string>()
  readonly cta = input.required<EmptyAction>()
  readonly alt = input<EmptyAction>()
  readonly ctaClick = output()
  readonly altClick = output()
  protected readonly tones = TONE
}
