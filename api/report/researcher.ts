import { createVercelReportHandler } from '../../src/server/reportApiAdapter';

export default createVercelReportHandler();

export const config = {
  maxDuration: 60,
};
