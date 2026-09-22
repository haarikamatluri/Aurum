import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VoiceAssistantComponent } from './features/voice-assistant/voice-assistant.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, VoiceAssistantComponent],
  template: `
    <router-outlet />
    <aurum-voice-assistant></aurum-voice-assistant>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
