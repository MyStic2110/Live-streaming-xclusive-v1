import { useEffect } from 'react';
import { novaClient } from '../NovaClient.js';

/**
 * The ultimate DX Hook.
 * Registers an action ONLY when the component is actively on the screen.
 * This guarantees the LLM prompt is microscopically small, eliminating token bloat.
 */
export const useNova = ({ actionName, description, execute }) => {
    useEffect(() => {
        // Register capability on mount
        novaClient.registerCapability({ name: actionName, description, execute });
        
        // Unregister capability on unmount (cleanup)
        return () => {
            novaClient.store.unregister(actionName);
            // Publish update so the backend knows this action is no longer available
            novaClient.eventBus.publish('schema_updated', novaClient.store.getSchema());
        };
    }, [actionName, description, execute]);
};
