import { Link } from "react-router-dom";
import { toggleTheme } from "@reouvir/shared/theme";

export function Header({ onLogout, back }: { onLogout: () => void; back?: string }) {
  return (
    <header className="top">
      {back && <Link to={back} aria-label="Voltar">←</Link>}
      <h1>
        Reouvir EN <small>Hear it again.</small>
      </h1>
      <button onClick={() => toggleTheme()} aria-label="Alternar tema">◐</button>
      <button className="link" onClick={onLogout}>Sair</button>
    </header>
  );
}
