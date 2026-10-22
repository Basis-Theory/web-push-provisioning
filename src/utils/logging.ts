type AttributeMap = Record<string, string>;

let disableTelemetry = false;

export const configureLogger = ({
  disableTelemetry: disableTelemetryArg,
}: {
  disableTelemetry: boolean;
}) => {
  disableTelemetry = disableTelemetryArg;
};

export const logger = (() => {
  const ddTok = 'pubb96b84a13912504f4354f2d794ea4fab';
  const service = 'web-push-provisioning';

  const log = async (
    message: string,
    level: string,
    error?: Error,
    attributes: AttributeMap = {}
  ) => {
    if (disableTelemetry) {
      return;
    }

    const payload = {
      application: service,
      ddsource: service,
      service,
      ...attributes,
      level,
      message:
        level === 'error' && error ? `${message}: ${error.message}` : message,
    };

    try {
      const response = await fetch(
        `https://http-intake.logs.datadoghq.com/v1/input/${ddTok}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
    } catch {
      // Do nothing
    }
  };

  return {
    log: {
      error: (message: string, error?: Error, attributes?: AttributeMap) =>
        log(message, 'error', error, attributes),
      info: (message: string, attributes?: AttributeMap) =>
        log(message, 'info', undefined, attributes),
      warn: (message: string, attributes?: AttributeMap) =>
        log(message, 'warn', undefined, attributes),
    },
  };
})();
