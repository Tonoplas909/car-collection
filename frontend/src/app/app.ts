import { Component, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { GlobalFx } from './global-fx'
import { Store } from './core/store'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobalFx],
  template: `
    @if (store.status() === 'ready') {
      <app-global-fx />
      <router-outlet />
    }
  `,
})
export class App {
  protected store = inject(Store)
}
