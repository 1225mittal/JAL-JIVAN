import React from 'react';
import DebitNoteManager from './purchase/DebitNoteManager';

export function DebitNoteHub(props) {
  return <DebitNoteManager {...props} />;
}

export { DebitNoteManager };
export default DebitNoteHub;

