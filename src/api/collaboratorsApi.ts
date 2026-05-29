import type { LinkCollaboratorInput, LinkCollaboratorResult } from '../services/collaborators/types';
import { linkCollaborator } from '../services/collaborators/linkCollaborators';

/**
 * Capa API colaboradores — invoca el servicio directamente en el cliente.
 * En dev/preview, el middleware Vite expone las mismas rutas para integraciones externas.
 */
export function linkCollaboratorWorks(
  input: LinkCollaboratorInput = {}
): Promise<LinkCollaboratorResult> {
  return linkCollaborator(input);
}

export { linkCollaborator };
export type { LinkCollaboratorInput, LinkCollaboratorResult };
