import { useCallback, useContext, type PropsWithChildren } from "react";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { isTabOrShift, type InteractionEvent } from "../utils/events";

import { store } from "../store";
import ACTIONS from "../actions";

import "./RightDrawer.scss";

export default function RightDrawer({ children }: PropsWithChildren) {
  const { state, dispatch } = useContext(store);
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const openRightDrawer = useCallback(
    (event: InteractionEvent) => {
      if (isTabOrShift(event)) {
        return;
      }
      dispatch({ type: ACTIONS.SET_RIGHT_DRAWER_OPENED, data: true });
    },
    [dispatch]
  );

  const closeRightDrawer = useCallback(
    (event: InteractionEvent) => {
      if (isTabOrShift(event)) {
        return;
      }
      dispatch({ type: ACTIONS.SET_RIGHT_DRAWER_OPENED, data: false });
    },
    [dispatch]
  );

  return (
    <SwipeableDrawer
      className="right-drawer"
      anchor="right"
      open={state.isRightDrawerOpen}
      onClose={closeRightDrawer}
      onOpen={openRightDrawer}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
      onKeyDown={closeRightDrawer}
    >
      <div className="drawer-content">{children}</div>
    </SwipeableDrawer>
  );
}
