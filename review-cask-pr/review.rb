require "json"
require "tmpdir"
require "open3"
require "English"

Homebrew.install_gem! "git_diff"
require "git_diff"

require_relative "git_diff_extensions"
using GitDiffExtension

require "utils/github"

def diff_for_pull_request(pr)
  diff_url = pr.fetch("diff_url")

  output, _, status = curl_output("--location", diff_url)

  GitDiff.from_string(output) if status.success?
end

def review_pull_request(pr)
  repo   = pr.fetch("base").fetch("repo").fetch("full_name")
  number = pr.fetch("number")
  sha    = pr.fetch("head").fetch("sha")

  pr_name = "#{repo}##{number}"

  if pr.fetch("draft")
    puts "Pull request #{pr_name} is a draft."
    return
  end

  reviews = GitHub.open_api("#{pr.fetch("url")}/reviews")
  non_dismissed_reviews = reviews.reject { |r| r.fetch("state") == "DISMISSED" }
  if non_dismissed_reviews.any?
    puts "Pull request #{pr_name} has reviews."
    return
  end

  diff = diff_for_pull_request(pr)

  unless diff.simple?
    puts "Pull request #{pr_name} is not a “simple” version bump."
    return
  end

  author_is_member = pr.fetch("author_association") == "MEMBER"

  if diff.version_changed?
    version_decreased = diff.version_decreased?
    if version_decreased && !author_is_member
      return {
        event: :COMMENT,
        message: "Version decreased from `#{diff.old_version}` to `#{diff.new_version}`."
      }
    end

    previous_versions = Dir.mktmpdir do |repo_dir|
      branch = pr.fetch("base").fetch("ref")
      clone_url = pr.fetch("base").fetch("repo").fetch("clone_url")

      system 'git', 'clone', '-b', branch, clone_url, repo_dir
      raise unless $CHILD_STATUS.success?

      out, err, status = Open3.capture3(
        'git', '-C', repo_dir, 'log', '--pretty=format:', '-G', '\s+version\s+(\'|")', '--follow', '--patch', '--', diff.cask_path,
      )
      raise err unless status.success?

      version_diff = GitDiff.from_string(out)
      version_diff.additions.select { |l| l.version? }.map { |l| l.version }.uniq
    end

    if previous_versions.include?(diff.new_version)
      if author_is_member && pr.fetch("title").start_with?("Revert ") &&
          diff.old_version == previous_versions[0] && diff.new_version == previous_versions[1]
        return {
          event: :APPROVE,
          message: "Reverted from `#{diff.old_version}` to previous version `#{diff.new_version}` by a project member."
        }
      end

      previous_version_list = previous_versions.map { |v| "  - `#{v}`" }.join("\n")

      return {
        event: :COMMENT,
        message: "Version changed to a previous version. Previous versions were:\n#{previous_version_list}",
      }
    end

    return {
      event: :APPROVE,
      message: "Simple version bump from `#{diff.old_version}` to `#{diff.new_version}`."
    }
  end

  {
    event: :APPROVE,
    message: "Simple checksum-only change."
  }
end

begin
  event_name, event_path, = ARGV

  case event_name
  when "pull_request", "pull_request_target"
    event = JSON.parse(File.read(event_path))

    # Reload the pull request data in case it changed since the event was triggered.
    pr = GitHub.open_api(event.fetch("pull_request").fetch("url"))

    if output = review_pull_request(pr)
      message = output.fetch(:message)

      puts message
      puts "::set-output name=event::#{output.fetch(:event)}"
      puts "::set-output name=message::#{GitHub::Actions.escape(message)}"
    end
  when %r{^https://github.com/([^\/]+)/([^\/]+)/pull/(\d+)}
    owner = Regexp.last_match[1]
    repo = Regexp.last_match[2]
    number = Integer(Regexp.last_match[3])

    pr = GitHub.open_api("https://api.github.com/repos/#{owner}/#{repo}/pulls/#{number}")

    review = review_pull_request(pr)
    return unless review

    puts review[:event]
    puts review[:message]
  else
    raise "Unsupported GitHub Actions event: #{event_name.inspect}"
  end
end
