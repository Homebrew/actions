FROM homebrew/ubuntu16.04:master

RUN brew ruby -e 'Homebrew.install_gem! "git_diff"'

ADD review.rb /review.rb
ADD git_diff_extension.rb /git_diff_extension.rb
ADD entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
