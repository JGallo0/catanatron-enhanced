import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, expect } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

test("renders A2 scenic home stage and opens Quick Match setup modal in Portuguese", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole("heading", { name: /Rule the Isle/i })).toBeInTheDocument();
  expect(screen.getByText(/Mãos Privadas no Multiplayer/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Partida Rápida/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Criar Sala Online/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Salas Abertas/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Ranking & Histórico/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Personalizar Avatar/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /Partida Rápida/i }));
  expect(await screen.findByText(/Modelo do Mapa/i)).toBeInTheDocument();
  expect(screen.getByText(/Pontos para Vencer/i)).toBeInTheDocument();
  expect(screen.getByText(/Limite de Cartas/i)).toBeInTheDocument();
  expect(screen.getByText(/^Jogadores na Mesa$/i)).toBeInTheDocument();
}, 15000);
