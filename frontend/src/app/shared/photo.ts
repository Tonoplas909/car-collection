import { Component, input } from '@angular/core'
import type { Car } from '@game'

/** Striped placeholder until a photo exists; real photos print black and white. */
@Component({
  selector: 'app-photo',
  host: { class: 'photo' },
  template: `
    @if (car()?.photoUrl) {
      <img [src]="car()!.photoUrl" [alt]="car()!.make + ' ' + car()!.model" class="grayscale" loading="lazy" />
    } @else {
      <span>{{ label() }}</span>
    }
  `,
})
export class Photo {
  readonly car = input<Car | null | undefined>()
  readonly label = input('car photo')
}
