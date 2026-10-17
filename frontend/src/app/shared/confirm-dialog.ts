import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core'

/** Confirm dialog (States 9e): red header (kind + title), row summary, note, primary and Cancel. */
@Component({
  selector: 'app-confirm-dialog',
  host: { '(document:keydown.escape)': 'cancel.emit()' },
  template: `
    <div class="dlg-backdrop" (mousedown)="$event.target === $event.currentTarget && cancel.emit()">
      <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="dlg-head">
          <span class="kind">{{ kind() }}</span>
          <div class="title" id="dlg-title">{{ title() }}</div>
        </div>
        <div class="dlg-body">
          <ng-content />
          @for (r of rows(); track $index) {
            <div class="dlg-row"><span>{{ r[0] }}</span><span>{{ r[1] }}</span></div>
          }
          @if (error()) {
            <span class="dlg-note"><span class="err">{{ error() }}</span></span>
          } @else if (note()) {
            <span class="dlg-note">{{ note() }}</span>
          }
        </div>
        <div class="dlg-actions">
          <button #okBtn type="button" class="btn btn-dark" (click)="ok.emit()" [disabled]="busy()">{{ busy() ? 'Working…' : okLabel() }}</button>
          <button type="button" class="btn btn-outline" (click)="cancel.emit()">Cancel</button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  readonly kind = input.required<string>()
  readonly title = input.required<string>()
  readonly rows = input<[string, string][]>([])
  readonly note = input<string>('')
  readonly error = input<string>('')
  readonly okLabel = input.required<string>()
  readonly busy = input(false)
  readonly ok = output()
  readonly cancel = output()
  private okBtn = viewChild<ElementRef<HTMLButtonElement>>('okBtn')

  constructor() {
    afterNextRender(() => this.okBtn()?.nativeElement.focus())
  }
}
