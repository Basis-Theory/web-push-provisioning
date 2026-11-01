type AttributeMap = Record<string, string>;

type Logger = {
  log: {
    error: (
      message: string,
      error?: Error,
      attributes?: AttributeMap
    ) => Promise<void>;
    info: (message: string, attributes?: AttributeMap) => Promise<void>;
    warn: (message: string, attributes?: AttributeMap) => Promise<void>;
  };
};

const DD_CLIENT_TOKEN = 'pubb96b84a13912504f4354f2d794ea4fab';
const SERVICE = 'web-push-provisioning';

const createLogger = ({
  disableTelemetry,
}: {
  disableTelemetry: boolean;
}): Logger => {
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
      application: SERVICE,
      ddsource: SERVICE,
      service: SERVICE,
      ...attributes,
      level,
      message:
        level === 'error' && error ? `${message}: ${error.message}` : message,
    };

    try {
      const response = await fetch(
        `https://http-intake.logs.datadoghq.com/v1/input/${DD_CLIENT_TOKEN}`,
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
      error: (message, error, attributes) =>
        log(message, 'error', error, attributes),
      info: (message, attributes) =>
        log(message, 'info', undefined, attributes),
      warn: (message, attributes) =>
        log(message, 'warn', undefined, attributes),
    },
  };
};

export { createLogger };
export type { Logger };
