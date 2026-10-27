const core = require('@actions/core');

class HoneyCombMarkerRequestDto {
    id;
    dataset;
    type;
    message;
    start_time;
    end_time;
    url;
    treat_missing_dataset_as_warning;

    constructor(id, dataset, type, message, startTime, endTime, url, treat_missing_dataset_as_warning) {
        this.id = id || null;
        this.dataset = dataset || null;
        this.type = type || null;
        this.message = message || null;
        this.start_time = parseInt(startTime) || null;
        this.end_time = parseInt(endTime) || null;
        this.url = url || null;
        this.treat_missing_dataset_as_warning = treat_missing_dataset_as_warning || false;
    }
}

try {
    const apiKey = core.getInput('api-key');
    const id = core.getInput('id');
    const dataset = core.getInput('dataset');
    const operation = core.getInput('operation');
    const type = core.getInput('type');
    const message = core.getInput('message');
    const startTime = core.getInput('start-time');
    const endTime = core.getInput('end-time');
    const url = core.getInput('url');
    const treat_missing_dataset_as_warning = core.getBooleanInput('treat-missing-dataset-as-warning');

    const requestDto = new HoneyCombMarkerRequestDto(id, dataset, type, message, startTime, endTime, url);

    const send = async (method, url) => {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-Honeycomb-Team": apiKey
            },
            body: JSON.stringify(requestDto)
        });

        const text = await response.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { error: text };
        }

        const result = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data
        };

        if (!response.ok) {
            const error = new Error(`Request failed with status ${response.status}`);
            error.response = result;
            throw error;
        }

        return result;
    }

    this.treat_missing_dataset_as_warning = treat_missing_dataset_as_warning;
    this.requestDto = requestDto;

    const processResponse = (response) => {
        console.log(`Marker ${JSON.stringify(requestDto)}. Response: ${JSON.stringify(response.data)}`);
        console.log(`${response.status} ${response.statusText}`);

        core.setOutput('id', response.data.id);
        core.setOutput('created-at', response.data.created_at);
        core.setOutput('updated-at', response.data.updated_at);
        core.setOutput('message', response.data.message);
        core.setOutput('start-time', response.data.start_time);
        core.setOutput('end-time', response.data.start_time);
    }

    const processError = (error) => {
        if (!error.response) {
            console.log(error);
            core.setFailed(error.message);
            return;
        }

        console.log(error.response.data.error);
        console.log(error.response.status);
        console.log(error.response.headers);

        if (error.response.status == 404 && error.response.data.error == 'dataset not found'
            && this.treat_missing_dataset_as_warning) {
            core.warning(`Dataset '${this.requestDto.dataset}' not found.`)
            return;
        }

        core.setFailed(error.response.data.error);
    }

    switch (operation.toLowerCase()) {
        case 'create':
            send('POST', `https://api.honeycomb.io/1/markers/${dataset}`)
                .then(processResponse)
                .catch(processError);
            break;
        case 'update':
            if (!requestDto.id) throw new Error('Honeycomb marker `id` is required for update operation type.')
            if (!requestDto.dataset) throw new Error('Honeycomb marker `dataset` is required for update operation type.')

            send('PUT', `https://api.honeycomb.io/1/markers/${dataset}/${requestDto.id}`)
                .then(processResponse)
                .catch(processError);
            break;
        default:
            throw new Error(`Operation ${operation} is not supported.`);
    }
} catch (error) {
    console.log(error)
    core.setFailed(error.message);
}
