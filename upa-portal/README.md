# Adjuster Portal

## Backend Requirements

* [Docker](https://docs.docker.com/get-docker/)
* [Docker Compose](https://docs.docker.com/compose/reference)
* [Poetry](https://python-poetry.org/) for Python package and environment management.

## Backend local development

* Start the stack with Docker Compose:

```bash
docker compose up -d
```

## Backend local development, additional details

### General workflow

By default, the dependencies are managed with [Poetry](https://python-poetry.org/), go there and install it.

From `./backend/app/` you can install all the dependencies with:

```console
$ poetry install
```

Then you can start a shell session with the new environment with:

```console
$ poetry shell
```

Next, open your editor at `./backend/app/` (instead of the project root: `./`), so that you see an `./app/` directory
with your code inside. That way, your editor will be able to find all the imports, etc. Make sure your editor uses the
environment you just created with Poetry.

Modify or add SQLAlchemy models in `./backend/app/app/models/`, Pydantic schemas in `./backend/app/app/schemas/`, API
endpoints in `./backend/app/app/api/`, CRUD (Create, Read, Update, Delete) utils in `./backend/app/app/crud/`.

Add and modify tasks to the Celery worker in `./backend/app/app/worker.py`.

If you need to install any additional package to the worker, add it to the file `./backend/app/Dockerfile.celery`
or `./backend/app/Dockerfile.celery.dev`.

### Docker Compose Override

During development, you can change Docker Compose settings that will only affect the local development environment, in
the file `compose.override.yaml`.

The changes to that file only affect the local development environment, not the production environment. So, you can
add "temporary" changes that help the development workflow.

To get inside the container with a `bash` session you can start the stack with:

```console
$ docker compose up -d
```

and then `exec` inside the running container:

```console
$ docker compose exec backend bash
```

### Live development with Python Jupyter Notebooks

If you know about Python [Jupyter Notebooks](http://jupyter.org/), you can take advantage of them during local
development.

The `compose.override.yaml` file sends a variable `env` with a value `dev` to the build process of the Docker
image (during local development) and the `Dockerfile` has steps to then install and configure Jupyter inside your Docker
container.

So, you can enter into the running Docker container:

```bash
docker compose exec backend bash
```

And use the environment variable `$JUPYTER` to run a Jupyter Notebook with everything configured to listen on the public
port (so that you can use it from your browser).

It will output something like:

```console
root@73e0ec1f1ae6:/app# $JUPYTER
[I 12:02:09.975 NotebookApp] Writing notebook server cookie secret to /root/.local/share/jupyter/runtime/notebook_cookie_secret
[I 12:02:10.317 NotebookApp] Serving notebooks from local directory: /app
[I 12:02:10.317 NotebookApp] The Jupyter Notebook is running at:
[I 12:02:10.317 NotebookApp] http://(73e0ec1f1ae6 or 127.0.0.1):8888/?token=f20939a41524d021fbfc62b31be8ea4dd9232913476f4397
[I 12:02:10.317 NotebookApp] Use Control-C to stop this server and shut down all kernels (twice to skip confirmation).
[W 12:02:10.317 NotebookApp] No web browser found: could not locate runnable browser.
[C 12:02:10.317 NotebookApp]

    Copy/paste this URL into your browser when you connect for the first time,
    to login with a token:
        http://(73e0ec1f1ae6 or 127.0.0.1):8888/?token=f20939a41524d021fbfc62b31be8ea4dd9232913476f4397
```

you can copy that URL and modify the "host" to be `localhost` or the domain you are using for development (
e.g. `dev.adjuster-portal.com`), in the case above, it would be, e.g.:

```
http://localhost:8888/token=f20939a41524d021fbfc62b31be8ea4dd9232913476f4397
```

and then open it in your browser.

You will have a full Jupyter Notebook running inside your container that has direct access to your database by the
container name (`db`), etc. So, you can just run sections of your backend code directly, for example
with [VS Code Python Jupyter Interactive Window](https://code.visualstudio.com/docs/python/jupyter-support-py)
or [Hydrogen](https://github.com/nteract/hydrogen).

### Development with a custom IP

If you are running Docker in an IP address different from `127.0.0.1` (`localhost`), you will need to perform some
additional steps. That will be the case if you are running a custom
Virtual Machine, your Docker is located in a different machine in your network.

In that case, you will need to use a fake local domain (`dev.adjuster-portal.com`) and make your computer think that the
domain is served by the custom IP (e.g. `192.168.99.150`).

If you used the default CORS enabled domains, `dev.adjuster-portal.com` was configured to be allowed. If you want a
custom one, you need to add it to the list in the variable `BACKEND_CORS_ORIGINS` in the `.env` file.

* Open your `hosts` file with administrative privileges using a text editor:
    * **Note for Windows**: If you are in Windows, open the main Windows menu, search for "notepad", right click on it,
      and select the option "open as Administrator" or similar. Then click the "File" menu, "Open file", go to the
      directory `c:\Windows\System32\Drivers\etc\`, select the option to show "All files" instead of only "Text (.txt)
      files", and open the `hosts` file.
    * **Note for Mac and Linux**: Your `hosts` file is probably located at `/etc/hosts`, you can edit it in a terminal
      running `sudo nano /etc/hosts`.

* Additional to the contents it might have, add a new line with the custom IP (e.g. `192.168.99.150`) a space character,
  and your fake local domain: `dev.adjuster-portal.com`.

The new line might look like:

```
192.168.99.100    dev.adjuster-portal.com
```

* Save the file.
    * **Note for Windows**: Make sure you save the file as "All files", without an extension of `.txt`. By default,
      Windows tries to add the extension. Make sure the file is saved as is, without extension.

...that will make your computer think that the fake local domain is served by that custom IP, and when you open that URL
in your browser, it will talk directly to your locally running server when it is asked to go
to `dev.adjuster-portal.com` and think that it is a remote server while it is actually running in your computer.

To configure it in your stack, follow the section **Change the development "domain"** below, using the
domain `dev.adjuster-portal.com`.

After performing those steps you should be able to open: http://dev.adjuster-portal.com and it will be server by your
stack in `localhost`.

Check all the corresponding available URLs in the section at the end.

### Change the development "domain"

If you need to use your local stack with a different domain than `localhost`, you need to make sure the domain you use
points to the IP where your stack is set up. See the different ways to achieve that in the sections above (i.e.
using `dev.adjuster-portal.com`).

To simplify your Docker Compose setup, for example, so that the API docs (Swagger UI) knows where is your API, you
should let it know you are using that domain for development. You will need to edit 1 line in 2 files.

* Open the file located at `./.env`. It would have a line like:

```
DOMAIN=localhost
```

* Change it to the domain you are going to use, e.g.:

```
DOMAIN=dev.adjuster-portal.com
```

After changing the line, you can re-start your stack with:

```console
$ docker compose up -d
```

and check all the corresponding available URLs in the section at the end.

## Deployment

CI (continuous integration) systems already setup to do it automatically.

#### Deployment Technical Details

Building and pushing is done with the `docker-compose.yml` file, using the `docker compose` command. The
file `docker-compose.yml` uses the file `.env` with default environment variables. And the scripts set some additional
environment variables as well.

### Continuous Integration / Continuous Delivery

GitLab CI, the included `.gitlab-ci.yml` can automatically deploy it.

In case of any other CI/CD provider, base your deployment from that `.gitlab-ci.yml` file, as all the actual
script steps are performed in `bash` scripts that you can easily re-use.

GitLab CI is configured assuming 2 environments following GitLab flow:

* `production` from the `production` branch.
* `staging` from the `main` branch.

### The .env file

The `.env` file is the one that contains all your configurations, generated keys and passwords, etc.
