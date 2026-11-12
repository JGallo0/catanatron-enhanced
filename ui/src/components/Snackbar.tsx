import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { GameState } from "../utils/api.types";
import { humanizeActionRecordPt } from "../utils/promptUtils";
import { getCurrentLanguage, tr } from "../i18n";

// No types exported from notistack;
type SnackbarKey = string | number;

export const snackbarActions =
  (closeSnackbar: (key?: SnackbarKey) => void) => (key: string) => (
    <>
      <IconButton
        size="small"
        aria-label={tr("fechar", "close")}
        color="inherit"
        onClick={() => closeSnackbar(key)}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </>
  );

export function dispatchSnackbar(
  enqueueSnackbar: (
    message: string,
    options: { action: (key: string) => React.ReactNode; onClick: () => void }
  ) => SnackbarKey,
  closeSnackbar: (key?: string | number) => void,
  gameState: GameState
) {
  const latestRecord = gameState.action_records.slice(-1)[0];
  if (!latestRecord) return;
  enqueueSnackbar(
    humanizeActionRecordPt(gameState, latestRecord, getCurrentLanguage()),
    {
      action: snackbarActions(closeSnackbar),
      onClick: () => {
        closeSnackbar();
      },
    }
  );
}
