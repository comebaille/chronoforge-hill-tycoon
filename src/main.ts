import './styles/main.css';
import { ChronoforgeApp } from './ui/app';

document.documentElement.style.setProperty('--key-art-image', `url("${import.meta.env.BASE_URL}assets/generated/chronoforge-key-art.webp")`);
document.documentElement.style.setProperty('--unit-sprites-image', `url("${import.meta.env.BASE_URL}assets/original/unit-sprites.svg")`);

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Point de montage #app introuvable');

const app = new ChronoforgeApp(root);

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy());
}
