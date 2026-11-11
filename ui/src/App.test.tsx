import { test, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "./App";

test("renders setup controls on the home page in Portuguese", () => {
  const { getByText, getAllByText } = render(<App />);
  expect(getByText(/Modelo do Mapa/i)).toBeInTheDocument();
  expect(getByText(/Pontos para Vencer/i)).toBeInTheDocument();
  expect(getByText(/Limite de Cartas/i)).toBeInTheDocument();
  expect(getByText(/Mãos privadas no multiplayer/i)).toBeInTheDocument();
  expect(getByText(/^Jogadores na Mesa$/i)).toBeInTheDocument();
  expect(getByText(/^Iniciar Partida Rápida$/i)).toBeInTheDocument();
  expect(getAllByText(/^Entrar$/i).length).toBeGreaterThanOrEqual(1);
  expect(getByText(/^Criar Conta$/i)).toBeInTheDocument();
  expect(getByText(/Ranking & Histórico/i)).toBeInTheDocument();
});
