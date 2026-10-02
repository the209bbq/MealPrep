import { useApp } from '../../context/AppContext';
import { AccountSheet } from './AccountSheet';
import { AuthSheet } from './AuthSheet';
import { PostSignupProfileSheet } from './PostSignupProfileSheet';

export function AccountOverlays() {
  const { accountUi, completePostSignupSetup } = useApp();

  return (
    <>
      <AuthSheet visible={accountUi.sheet === 'auth'} onClose={accountUi.closeSheet} />
      <AccountSheet visible={accountUi.sheet === 'account'} onClose={accountUi.closeSheet} />
      <PostSignupProfileSheet
        visible={accountUi.showPostSignupSetup}
        onDone={completePostSignupSetup}
      />
    </>
  );
}
