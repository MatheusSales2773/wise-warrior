import { useCallback, useEffect, useRef } from 'react';
import { useSignOut } from '@/features/auth/use-sign-out';
import { AccessibilityInfo, findNodeHandle, Platform, type View } from 'react-native';
import { MobileNavigation } from '../navigation/MobileNavigation';
import { MoreMenu } from '../navigation/MoreMenu';
import { WebSidebar } from '../navigation/WebSidebar';

type AppNavigationProps = {
  bottomInset: number;
  isDesktop: boolean;
  modalVisible: boolean;
  onModalVisibilityChange: (visible: boolean) => void;
  pathname: string;
};

export function AppNavigation({ bottomInset, isDesktop, modalVisible, onModalVisibilityChange, pathname }: AppNavigationProps) {
  const handleLogout = useSignOut();
  const moreButtonRef = useRef<View>(null);
  const shownPathname = useRef(pathname);

  // A destination opened from "Mais" changes the route; the menu closes so the new screen is reachable.
  useEffect(() => {
    if (shownPathname.current === pathname) return;
    shownPathname.current = pathname;
    if (modalVisible) onModalVisibilityChange(false);
  }, [modalVisible, onModalVisibilityChange, pathname]);

  const openMore = useCallback(() => {
    onModalVisibilityChange(true);
  }, [onModalVisibilityChange]);

  const closeMore = useCallback(() => {
    onModalVisibilityChange(false);
    setTimeout(() => {
      restoreNavigationTriggerFocus(moreButtonRef.current);
    }, 0);
  }, [onModalVisibilityChange]);

  if (isDesktop) return <WebSidebar onLogout={handleLogout} pathname={pathname} />;

  return (
    <>
      <MobileNavigation
        bottomInset={bottomInset}
        hiddenForModal={modalVisible}
        moreActive={modalVisible}
        onOpenMore={openMore}
        pathname={pathname}
        ref={moreButtonRef}
      />
      <MoreMenu bottomInset={bottomInset} onClose={closeMore} onLogout={handleLogout} pathname={pathname} visible={modalVisible} />
    </>
  );
}

export function restoreNavigationTriggerFocus(target: View | null, platform = Platform.OS): void {
  if (platform === 'web') {
    (target as unknown as { focus?: () => void } | null)?.focus?.();
    return;
  }
  const handle = target ? findNodeHandle(target) : null;
  if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
}
