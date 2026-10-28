import { Link } from "react-router-dom";
import { toggleTheme } from "@reouvir/shared/theme";
import { IconBack, IconTheme } from "./Icons";

export function Header({ onLogout, back }: { onLogout: () => void; back?: string }) {
  return (
    <header className="top">
      {back && <Link className="icon-btn" to={back} aria-label="Voltar para o início"><IconBack /></Link>}
      <h1>
        Reouvir EN <small>Hear it again.</small>
      </h1>
      <button className="icon-btn" onClick={() => toggleTheme()} aria-label="Alternar tema claro e escuro"><IconTheme /></button>
      <button className="link" onClick={onLogout}>Sair</button>
    </header>
  );
}
