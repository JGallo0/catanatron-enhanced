import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import ResourceSelector from "./ResourceSelector";
afterEach(cleanup);

test("selects two identical cards, supports undo, and only submits on confirmation", async () => {
  const onSelect = vi.fn();
  render(<ResourceSelector open onClose={vi.fn()} onSelect={onSelect} mode="yearOfPlenty" options={[["WOOD", "WOOD"], ["WOOD", "ORE"]]} />);
  const wood = screen.getByRole("button", { name: "Selecionar Madeira" });
  fireEvent.click(wood); fireEvent.click(wood);
  expect(screen.getByText("Madeira + Madeira")).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
  expect(screen.getByRole("button", { name: "Confirmar recursos" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar Minério" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recursos" }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(["WOOD", "ORE"]));
});

test("respects bank stock, canonical ordering and a bank with only one resource", async () => {
  const onSelect = vi.fn();
  const props = { open: true, onClose: vi.fn(), onSelect, mode: "yearOfPlenty" as const };
  const view = render(<ResourceSelector {...props} options={[["WOOD", "ORE"]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar Minério" }));
  expect(screen.getByRole("button", { name: "Selecionar Minério" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Selecionar Madeira" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recursos" }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(["WOOD", "ORE"]));
  view.unmount();
  render(<ResourceSelector {...props} options={[["SHEEP"]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar Ovelha" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recursos" }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(["SHEEP"]));
});

test("keeps selection available after a failed submission", async () => {
  const close = vi.fn();
  render(<ResourceSelector open onClose={close} onSelect={vi.fn().mockRejectedValue(new Error())} mode="yearOfPlenty" options={[["SHEEP"]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar Ovelha" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar recursos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirmar recursos" })).toBeEnabled();
});
