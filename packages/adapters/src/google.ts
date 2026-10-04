// Google integrations (AC-114)
// Meet, Calendar, and Forms adapters with optional feature switches

export interface GoogleAdapterConfig {
  baseUrls: {
    meet: string;
    calendar: string;
    forms: string;
  };
  accessToken: string;
  switches?: Record<string, boolean>;
}

export interface GoogleAdapter {
  createMeetLink(options: { title: string }): Promise<{ url: string }>;
  syncCalendar(options: {
    calendarId: string;
    events: Array<{ id: string; title: string; start: number; end: number; timezone: string }>;
  }): Promise<{ synced: number }>;
  exportQuiz(options: {
    title: string;
    questions: Array<{ text: string; choices: string[]; answerIndex: number }>;
  }): Promise<{ formId: string; responderUri: string; published: boolean }>;
}

export function createGoogleAdapter(config: GoogleAdapterConfig): GoogleAdapter {
  const switches = config.switches || {};

  function checkSwitch(name: string): void {
    const isOn = switches[name] === true; // must be explicitly true
    if (!isOn) {
      throw new Error(`Switch ${name} is off`);
    }
  }

  return {
    async createMeetLink(options: { title: string }): Promise<{ url: string }> {
      checkSwitch('meetLinks');

      const response = await fetch(`${config.baseUrls.meet}/v2/spaces`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: options.title,
        }),
      });

      if (!response.ok) throw new Error(`Meet creation failed: ${response.statusText}`);
      const result = await response.json() as { meetingUri?: string };
      return { url: result.meetingUri || '' };
    },

    async syncCalendar(options: {
      calendarId: string;
      events: Array<{ id: string; title: string; start: number; end: number; timezone: string }>;
    }): Promise<{ synced: number }> {
      checkSwitch('calendarSync');

      let synced = 0;
      for (const event of options.events) {
        const response = await fetch(`${config.baseUrls.calendar}/calendar/v3/calendars/${options.calendarId}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: event.id,
            summary: event.title,
            start: {
              dateTime: new Date(event.start).toISOString(),
              timeZone: event.timezone,
            },
            end: {
              dateTime: new Date(event.end).toISOString(),
              timeZone: event.timezone,
            },
          }),
        });

        if (response.ok) synced++;
      }

      return { synced };
    },

    async exportQuiz(options: {
      title: string;
      questions: Array<{ text: string; choices: string[]; answerIndex: number }>;
    }): Promise<{ formId: string; responderUri: string; published: boolean }> {
      checkSwitch('googleForms');

      // Create form
      const formResponse = await fetch(`${config.baseUrls.forms}/v1/forms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          info: {
            title: options.title,
          },
        }),
      });

      if (!formResponse.ok) throw new Error(`Form creation failed: ${formResponse.statusText}`);
      const form = await formResponse.json() as { formId: string; responderUri: string };
      const formId = form.formId;

      // Add questions via batch update
      const updateResponse = await fetch(`${config.baseUrls.forms}/v1/forms/${formId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: options.questions.map((q) => ({
            createItem: {
              item: {
                title: q.text,
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: q.choices.map((choice) => ({ value: choice })),
                    },
                  },
                },
              },
            },
          })),
        }),
      });

      if (!updateResponse.ok) throw new Error(`Question creation failed: ${updateResponse.statusText}`);

      // Publish the form
      const publishResponse = await fetch(`${config.baseUrls.forms}/v1/forms/${formId}:setPublishSettings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publishSettings: {
            publishState: {
              isPublished: true,
              isAcceptingResponses: true,
            },
          },
        }),
      });

      if (!publishResponse.ok) throw new Error(`Form publish failed: ${publishResponse.statusText}`);

      return {
        formId,
        responderUri: form.responderUri,
        published: true,
      };
    },
  };
}
