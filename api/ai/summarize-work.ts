import { createVercelAiHandler } from '../../src/server/aiApiAdapter';

export default createVercelAiHandler('summarize-work');

export const config = {
  maxDuration: 60,
};
