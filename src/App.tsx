/**
 * Application shell. Router, role guards and the mock boundary live here.
 *
 * @requirement FR-04 FR-01 FR-34
 */
import { AppRouter } from './routes/AppRouter.tsx';

export default function App() {
  return <AppRouter />;
}
